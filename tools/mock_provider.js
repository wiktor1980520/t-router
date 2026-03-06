const http = require('http');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let delay = 0;

  if (url.pathname === '/fast') {
    delay = 10;
  } else if (url.pathname === '/slow') {
    delay = 500;
  } else {
    delay = 50; // default
  }

  setTimeout(() => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: "chatcmpl-123",
      object: "chat.completion",
      created: Date.now(),
      model: "mock-model",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: `Response from ${url.pathname} (delay: ${delay}ms)`
        },
        finish_reason: "stop"
      }]
    }));
  }, delay);
});

const PORT = 8081;
server.listen(PORT, () => {
  console.log(`Mock provider running on port ${PORT}`);
  console.log(`- /fast (10ms)`);
  console.log(`- /slow (500ms)`);
});