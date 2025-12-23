<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import './app.css';

  let messages: { sender: 'user' | 'ai'; content: string }[] = [];
  let inputText = '';
  let sessionId: string | null = null;
  let loading = false;
  let chatContainer: HTMLElement;
  let streaming = true;

  const BACKEND_URL = 'http://localhost:3001';

  onMount(async () => {
    const storedSessionId = localStorage.getItem('sessionId');
    if (storedSessionId) {
      sessionId = storedSessionId;
      await fetchHistory();
    }
  });

  afterUpdate(() => {
    scrollToBottom();
  });

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  async function fetchHistory() {
    if (!sessionId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/chat/history/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        // Map backend message format to frontend format
        messages = data.messages.map((m: any) => ({
          sender: m.sender,
          content: m.content
        }));
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  }

  async function sendMessage() {
    if (!inputText.trim() || loading) return;

    const message = inputText.trim();
    inputText = '';
    messages = [...messages, { sender: 'user', content: message }];
    loading = true;

    try {
      if (streaming) {
        messages = [...messages, { sender: 'ai', content: '' }];
        const aiIndex = messages.length - 1;
        const url = `${BACKEND_URL}/chat/stream?message=${encodeURIComponent(message)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`;
        const es = new EventSource(url);
        let receivedAny = false;
        let watchdog: number | undefined = undefined;
        const resetWatchdog = () => {
          if (watchdog) clearTimeout(watchdog);
          watchdog = setTimeout(async () => {
            try {
              es.close();
              const res = await fetch(`${BACKEND_URL}/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, sessionId: sessionId || undefined }),
              });
              const data = await res.json();
              if (res.ok) {
                if (!sessionId && data.sessionId) {
                  sessionId = data.sessionId;
                  localStorage.setItem('sessionId', sessionId!);
                }
                messages = messages.map((m, i) => i === aiIndex ? { sender: 'ai', content: m.content + (data.reply || '') } : m);
              } else {
                messages = messages.map((m, i) => i === aiIndex ? { sender: 'ai', content: m.content + `\nError: ${data.error || 'Something went wrong'}` } : m);
              }
            } catch {
              messages = messages.map((m, i) => i === aiIndex ? { sender: 'ai', content: m.content + '\nError: Could not connect to server.' } : m);
            } finally {
              loading = false;
            }
          }, 10000) as unknown as number;
        };
        resetWatchdog();
        es.onmessage = (e) => {
          const chunk = e.data;
          receivedAny = true;
          resetWatchdog();
          messages = messages.map((m, i) => i === aiIndex ? { sender: 'ai', content: m.content + chunk } : m);
        };
        es.addEventListener('ping', () => {
          resetWatchdog();
        });
        es.addEventListener('end', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (!sessionId && data.sessionId) {
              sessionId = data.sessionId;
              localStorage.setItem('sessionId', sessionId!);
            }
          } catch {}
          loading = false;
          if (watchdog) clearTimeout(watchdog);
          es.close();
        });
        es.onerror = () => {
          messages = messages.map((m, i) => i === aiIndex ? { sender: 'ai', content: m.content || 'Streaming error. Falling back...' } : m);
          if (watchdog) clearTimeout(watchdog);
          resetWatchdog();
          es.close();
        };
      } else {
        const res = await fetch(`${BACKEND_URL}/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, sessionId: sessionId || undefined }),
        });
        const data = await res.json();
        if (res.ok) {
          if (!sessionId && data.sessionId) {
            sessionId = data.sessionId;
            localStorage.setItem('sessionId', sessionId!);
          }
          messages = [...messages, { sender: 'ai', content: data.reply }];
        } else {
          messages = [...messages, { sender: 'ai', content: `Error: ${data.error || 'Something went wrong'}` }];
        }
        loading = false;
      }
    } catch (error) {
      messages = [...messages, { sender: 'ai', content: 'Error: Could not connect to server.' }];
      loading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function resetSession() {
    localStorage.removeItem('sessionId');
    sessionId = null;
    messages = [];
  }
</script>

<main class="flex flex-col h-screen bg-gray-100 font-sans">
  <!-- Header -->
  <header class="bg-blue-600 text-white p-4 shadow-md">
    <div class="max-w-3xl mx-auto flex items-center gap-2 justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold">G</div>
        <h1 class="text-xl font-bold">GadgetStore Support</h1>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center text-sm gap-1">
          <input type="checkbox" bind:checked={streaming} />
          Streaming
        </label>
        <button class="bg-white text-blue-600 rounded-full px-3 py-1 text-sm hover:bg-blue-50" on:click={resetSession}>Reset Session</button>
      </div>
    </div>
  </header>

  <!-- Chat Area -->
  <div class="flex-1 overflow-hidden max-w-3xl w-full mx-auto p-4 flex flex-col">
    <div 
      bind:this={chatContainer}
      class="flex-1 overflow-y-auto space-y-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200"
    >
      {#if messages.length === 0}
        <div class="text-center text-gray-500 mt-10">
          <p>Welcome to GadgetStore Support!</p>
          <p class="text-sm">Ask me about shipping, returns, or our products.</p>
        </div>
      {/if}

      {#each messages as msg}
        <div class={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div 
            class={`max-w-[80%] rounded-2xl px-4 py-2 text-sm md:text-base ${
              msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
            }`}
          >
            {msg.content}
          </div>
        </div>
      {/each}

      {#if loading}
        <div class="flex justify-start">
          <div class="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-none px-4 py-2 text-sm border border-gray-200">
            Thinking...
          </div>
        </div>
      {/if}
    </div>

    <!-- Input Area -->
    <div class="mt-4">
      <div class="relative flex items-center">
        <input
          type="text"
          bind:value={inputText}
          on:keydown={handleKeydown}
          placeholder="Type your message..."
          disabled={loading}
          class="w-full rounded-full border border-gray-300 py-3 px-5 pr-12 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm disabled:bg-gray-50 disabled:text-gray-400"
        />
        <button
          on:click={sendMessage}
          disabled={loading || !inputText.trim()}
          class="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          aria-label="Send"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      <div class="text-center mt-2 text-xs text-gray-400">
        AI can make mistakes. Please contact support@gadgetstore.com for urgent issues.
      </div>
    </div>
  </div>
</main>

<style>
  /* Custom scrollbar for webkit */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>
