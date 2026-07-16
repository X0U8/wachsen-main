export type AiRequestMode =
  | { useOwnKey: false }
  | {
      useOwnKey: true;
      byok: {
        provider: string;
        apiKey: string;
        model: string;
      };
    };

export const getAiRequestMode = (): AiRequestMode => {
  const useOwnKey = localStorage.getItem('use_own_key') === 'true';
  const provider = localStorage.getItem('provider') || 'mesh';
  const apiKeyKey = provider === 'mistral' ? 'mistral_api_key' : 'mesh_api_key';
  const apiKey = localStorage.getItem(apiKeyKey)?.trim() || '';

  if (!useOwnKey || !apiKey) {
    return { useOwnKey: false };
  }

  return {
    useOwnKey: true,
    byok: {
      provider,
      apiKey,
      model: localStorage.getItem('mesh_active_model') || '',
    },
  };
};
