export function internalError(res, publicMessage, error, status = 500) {
  // Keep logs useful without serializing request bodies, credentials, stack traces, or provider responses.
  console.error(JSON.stringify({
    event: 'api_error',
    errorName: String(error?.name || 'Error').slice(0, 80),
    errorCode: String(error?.code || '').slice(0, 80)
  }));
  return res.status(status).json({ ok: false, error: publicMessage });
}
