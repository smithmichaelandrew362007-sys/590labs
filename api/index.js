/**
 * 590 LABS® — Vercel Serverless Function Bridge
 * Exports the Express backend application for serverless API execution on Vercel.
 */

const app = require('../server/index');

module.exports = (req, res) => {
  if (req.url) {
    // Strip /api/index.js or /index.js prefix if passed by Vercel rewrite
    req.url = req.url.replace(/^\/api\/index\.js/, '/api').replace(/^\/index\.js/, '');
    
    // Ensure the request URL has the /api prefix for Express route mounting
    if (!req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }
  return app(req, res);
};
