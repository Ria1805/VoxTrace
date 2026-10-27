export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(path, options);
    if (!response.ok) {
      // Empty case selection is an expected state, not an API outage.
      if (response.status === 404 && /^\/api\/incidents\//.test(path)) return response;
      let detail = `API request failed (${response.status})`;
      try { const body = await response.clone().json(); if (typeof body.detail === 'string') detail = body.detail; } catch { /* Non-JSON proxy failure. */ }
      throw new Error(detail);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'API unavailable';
    window.dispatchEvent(new CustomEvent('voxtrace-api-error', { detail: `${message}. Check that the VoxTrace API is running at the configured address.` }));
    throw error;
  }
}
