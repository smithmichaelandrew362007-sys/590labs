const zlib = require('node:zlib');

/**
 * 590 LABS® Native HTTP Compression Middleware
 * Automatically compresses text, HTML, CSS, JavaScript, JSON, and SVG responses
 * using Brotli (br) or Gzip without any external dependencies.
 */
function nativeCompression(req, res, next) {
  const accept = req.headers['accept-encoding'] || '';
  if (!accept.includes('gzip') && !accept.includes('br') && !accept.includes('deflate')) {
    return next();
  }

  const oldWrite = res.write;
  const oldEnd = res.end;
  let chunks = [];
  let intercept = false;

  res.write = function(chunk, encoding) {
    const contentType = res.getHeader('Content-Type') || '';
    if (/text|javascript|json|xml|svg|html/i.test(contentType) && !res.getHeader('Content-Encoding')) {
      intercept = true;
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return true;
    }
    return oldWrite.apply(this, arguments);
  };

  res.end = function(chunk, encoding) {
    if (chunk) {
      const contentType = res.getHeader('Content-Type') || '';
      if (/text|javascript|json|xml|svg|html/i.test(contentType) && !res.getHeader('Content-Encoding')) {
        intercept = true;
      }
      if (intercept) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
    }

    if (!intercept || chunks.length === 0) {
      return oldEnd.apply(this, arguments);
    }

    const buffer = Buffer.concat(chunks);

    // Skip compression for tiny payloads (< 256 bytes)
    if (buffer.length < 256) {
      res.setHeader('Content-Length', buffer.length);
      return oldEnd.call(this, buffer);
    }

    res.setHeader('Vary', 'Accept-Encoding');

    if (accept.includes('br') && typeof zlib.brotliCompress === 'function') {
      zlib.brotliCompress(buffer, (err, compressed) => {
        if (err) return oldEnd.call(this, buffer);
        res.setHeader('Content-Encoding', 'br');
        res.setHeader('Content-Length', compressed.length);
        oldEnd.call(this, compressed);
      });
    } else if (accept.includes('gzip')) {
      zlib.gzip(buffer, (err, compressed) => {
        if (err) return oldEnd.call(this, buffer);
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', compressed.length);
        oldEnd.call(this, compressed);
      });
    } else {
      res.setHeader('Content-Length', buffer.length);
      oldEnd.call(this, buffer);
    }
  };

  next();
}

module.exports = nativeCompression;
