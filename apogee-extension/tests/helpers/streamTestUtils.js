export function createCollectingPort({ throwOnPost = false } = {}) {
  const messages = [];
  return {
    messages,
    postMessage(msg) {
      if (throwOnPost) {
        throw new Error("Port disconnected");
      }
      messages.push(msg);
    },
    disconnect() {},
  };
}

