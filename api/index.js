/**
 * 590 LABS® — Vercel Serverless Function Bridge
 * Exports the Express backend application for serverless API execution on Vercel.
 */

const app = require('../server/index');

module.exports = (req, res) => {
  // Ensure the request URL contains the /api prefix if stripped by Vercel serverless rewrites
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
