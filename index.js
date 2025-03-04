const express = require('express');
const { Ollama } = require("@langchain/community/llms/ollama");
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
const httpPort = 3000;
const wsPort = 3001;

// 使用 cors 中间件
app.use(cors());

// 解析 JSON 格式的请求体
app.use(express.json());

// 创建 Ollama 模型实例
const model = new Ollama({
  baseUrl: "http://localhost:11434",
  model: "deepseek-r1:1.5b",
});

// 定义一个 POST 路由来处理用户的请求
app.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    // 调用 Ollama 模型进行推理
    const response = await model.call(question);
    res.json({ answer: response });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

// 启动 HTTP 服务器
const httpServer = app.listen(httpPort, () => {
  console.log(`HTTP Server is running on port ${httpPort}`);
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ port: wsPort });

// 处理 WebSocket 连接
wss.on('connection', (ws) => {
  console.log('Client connected');

  // 处理客户端发送的消息
  ws.on('message', async (message) => {
    try {
      console.log('message===>', message);
      const question = message.toString();
      const stream = await model.stream(question);
      for await (const str of stream) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(str);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('An error occurred while processing your request.');
      }
    }
  });

  // 处理客户端关闭连接
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log(`WebSocket Server is running on port ${wsPort}`);