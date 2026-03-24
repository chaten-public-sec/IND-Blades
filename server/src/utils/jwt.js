const crypto = require('crypto');

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64url');
}

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signToken(payload, secret, expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const data = `${header}.${encodeJson(body)}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || !signaturePart) {
    return null;
  }

  const data = `${headerPart}.${payloadPart}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const signatureBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const payload = decodeJson(payloadPart);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && Number(payload.exp) < now) {
    return null;
  }

  return payload;
}

module.exports = {
  signToken,
  verifyToken
};
