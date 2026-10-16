const { searchProtocolChunks, getProtocolSection } = require('../../services/protocolRagService');

async function searchProtocols(queryText, { limit = 5 } = {}) {
  return searchProtocolChunks(queryText, { limit });
}

module.exports = {
  searchProtocols,
  getProtocolSection,
};
