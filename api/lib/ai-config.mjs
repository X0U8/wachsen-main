const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

export function resolveAiConfig(body, { meshApiKey, meshApiUrl, meshModel }) {
  const requestedByok = body?.useOwnKey === true;
  const byok = body?.byok && typeof body.byok === 'object' ? body.byok : {};
  const byokApiKey = typeof byok.apiKey === 'string' ? byok.apiKey.trim() : '';

  if (requestedByok && byokApiKey) {
    const provider = typeof byok.provider === 'string' && byok.provider.trim() ? byok.provider.trim() : 'mesh';
    const isMistral = provider === 'mistral';

    return {
      mode: 'byok',
      provider,
      apiLabel: isMistral ? 'Mistral' : 'Mesh',
      apiUrl: isMistral ? MISTRAL_API_URL : meshApiUrl,
      apiKey: byokApiKey,
      model: isMistral
        ? (byok.model || 'mistral-small-latest')
        : (byok.model || meshModel),
      isMistral,
      includeReasoningEffort: !isMistral,
    };
  }

  return {
    mode: 'server',
    provider: 'mesh',
    apiLabel: 'Mesh',
    apiUrl: meshApiUrl,
    apiKey: meshApiKey,
    model: meshModel,
    isMistral: false,
    includeReasoningEffort: true,
  };
}
