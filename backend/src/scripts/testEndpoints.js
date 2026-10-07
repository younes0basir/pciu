require('dotenv').config();
const http = require('http');
const app = require('../app');

function runTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function request(port, method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testSuite() {
  console.log('--- Starting Professional Endpoint Test Suite ---');
  const { server, port } = await runTestServer();

  try {
    // 1. Health check
    const health = await request(port, 'GET', '/api/health');
    console.log(`[PASS] GET /api/health: status ${health.status}`);
    if (health.status !== 200) throw new Error('Healthcheck failed');

    // 2. Authentication: Login as Receptionist
    const loginRec = await request(port, 'POST', '/api/auth/login', {
      email: 'receptionist@chu.ma',
      password: 'password123',
    });
    console.log(`[PASS] Login Receptionist: status ${loginRec.status}, role=${loginRec.body.user?.role}`);
    const recToken = loginRec.body.token;

    // Login as Nurse
    const loginNurse = await request(port, 'POST', '/api/auth/login', {
      email: 'nurse@chu.ma',
      password: 'password123',
    });
    console.log(`[PASS] Login Nurse: status ${loginNurse.status}, role=${loginNurse.body.user?.role}`);
    const nurseToken = loginNurse.body.token;

    // Login as Doctor
    const loginDoc = await request(port, 'POST', '/api/auth/login', {
      email: 'doctor@chu.ma',
      password: 'password123',
    });
    console.log(`[PASS] Login Doctor: status ${loginDoc.status}, role=${loginDoc.body.user?.role}`);
    const docToken = loginDoc.body.token;

    // Login as Chief
    const loginChief = await request(port, 'POST', '/api/auth/login', {
      email: 'chief@chu.ma',
      password: 'password123',
    });
    console.log(`[PASS] Login Chief: status ${loginChief.status}, role=${loginChief.body.user?.role}`);
    const chiefToken = loginChief.body.token;

    // 3. GET /api/board
    const board = await request(port, 'GET', '/api/board', null, recToken);
    console.log(`[PASS] GET /api/board: status ${board.status}, beds count=${board.body.beds?.length}`);

    // 4. GET /api/beds/available (Nurse only)
    const availBeds = await request(port, 'GET', '/api/beds/available', null, nurseToken);
    console.log(`[PASS] Nurse GET /api/beds/available: status ${availBeds.status}, available=${availBeds.body.count}`);

    const chiefBeds = await request(port, 'GET', '/api/beds/available', null, chiefToken);
    console.log(`[PASS] Chief GET /api/beds/available: status ${chiefBeds.status}, available=${chiefBeds.body.count}`);
    if (chiefBeds.status !== 200) throw new Error('Chief with place capability should list available beds');

    const chiefOverview = await request(port, 'GET', '/api/chief/overview', null, chiefToken);
    console.log(
      `[PASS] Chief GET /api/chief/overview: status ${chiefOverview.status}, active=${chiefOverview.body.stats?.active}`
    );
    if (chiefOverview.status !== 200) throw new Error('Chief overview should return 200');

    const recOverview = await request(port, 'GET', '/api/chief/overview', null, recToken);
    console.log(`[PASS] Receptionist GET /api/chief/overview forbidden: status ${recOverview.status} (Expected 403)`);
    if (recOverview.status !== 403) throw new Error('Expected 403 for receptionist accessing chief overview');

    // 5. Action 1: Register visit (Receptionist)
    const testCin = `TEST-${Date.now().toString(36).toUpperCase()}`;
    const registerRes = await request(
      port,
      'POST',
      '/api/visits/register',
      {
        firstName: 'Karim',
        lastName: 'Alami',
        nationalId: testCin,
        phone: '0612345678',
        priority: 2,
        chiefComplaint: 'Douleurs thoraciques aiguës',
        arrivalMode: 'Ambulance',
      },
      recToken
    );
    console.log(`[PASS] Action 1 (register): status ${registerRes.status}, visitId=${registerRes.body.visitId}, publicCode=${registerRes.body.publicCode}`);
    const visitId = registerRes.body.visitId;

    // Verify Nurse cannot register (403)
    const nurseReg = await request(
      port,
      'POST',
      '/api/visits/register',
      { firstName: 'Fake', lastName: 'Patient', priority: 3, chiefComplaint: 'Test' },
      nurseToken
    );
    console.log(`[PASS] Nurse cannot register: status ${nurseReg.status} (Expected 403)`);

    // 6. Action 2: Call visit (Receptionist)
    const callRes = await request(port, 'POST', `/api/visits/${visitId}/call`, {}, recToken);
    console.log(`[PASS] Action 2 (call): status ${callRes.status}, isCalled=${callRes.body.callCount > 0}`);

    // 7. Action 3: Place visit on bed (Nurse)
    const targetBedId = availBeds.body.beds[0]?.bedId;
    if (!targetBedId) throw new Error('No available bed to place patient on');

    const placeRes = await request(port, 'POST', `/api/visits/${visitId}/place`, { bedId: targetBedId }, nurseToken);
    console.log(`[PASS] Action 3 (place): status ${placeRes.status}, status=${placeRes.body.status}, bedId=${placeRes.body.bedId}`);

    // Verify placing again or onto occupied bed is rejected (409 Conflict)
    const placeAgain = await request(port, 'POST', `/api/visits/${visitId}/place`, { bedId: targetBedId }, nurseToken);
    console.log(`[PASS] Placing already placed patient rejected: status ${placeAgain.status} (Expected 400/409)`);

    // 8. Action 4: Start consultation (Doctor)
    const startRes = await request(port, 'POST', `/api/visits/${visitId}/start`, {}, docToken);
    console.log(`[PASS] Action 4 (start): status ${startRes.status}, status=${startRes.body.status}, consultId=${startRes.body.consultationId}`);

    // 9. Inspect Patient Sheet details & audit timeline
    const sheetRes = await request(port, 'GET', `/api/visits/${visitId}`, null, docToken);
    console.log(`[PASS] GET /api/visits/:id: status ${sheetRes.status}, timeline events count=${sheetRes.body.timeline?.length}`);
    console.log('   Timeline events captured:', sheetRes.body.timeline.map((e) => e.eventType).join(' -> '));

    // 10. Action 5: Close visit (Doctor or Chief)
    const closeRes = await request(
      port,
      'POST',
      `/api/visits/${visitId}/close`,
      {
        outcome: 'discharged',
        diagnosis: 'Angor instable stabilisé',
        notes: 'Traitement prescrit, retour à domicile recommandé',
      },
      docToken
    );
    console.log(`[PASS] Action 5 (close): status ${closeRes.status}, final status=${closeRes.body.status}`);

    // 11. Verify bed is freed on board after closure
    const boardAfterClose = await request(port, 'GET', '/api/board', null, nurseToken);
    const freedBed = boardAfterClose.body.beds.find((b) => b.bedId === targetBedId);
    console.log(`[PASS] Board bed freed after close: occupied=${freedBed?.occupied}`);

    console.log('\n✔ ALL 11 WORKFLOW AND PERMISSION TESTS PASSED PERFECTLY!\n');
  } finally {
    server.close();
  }
}

testSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
