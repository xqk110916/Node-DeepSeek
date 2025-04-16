const express = require('express');
const { Ollama } = require("@langchain/community/llms/ollama");
const cors = require('cors');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

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
    // 读取本地文本文件
    const filePath = path.join(__dirname, 'local_data.txt');
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // 将文件内容和问题合并
    const fullInput = `${fileContent}\n${question}`;

    // 调用 Ollama 模型进行推理
    const response = await model.call(fullInput);
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
  // 为每个客户端维护一个对话历史
  const conversationHistory = [];

  // 处理客户端发送的消息
  ws.on('message', async (message) => {
    try {
      console.log('message===>', message);
      const question = message.toString();
      // 读取本地文本文件
      const filePath = path.join(__dirname, './public/local_data.txt');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      console.log('fileContent', fileContent);
      

      // 将当前问题添加到对话历史
      conversationHistory.push({ role: 'user', content: question });
      // 构建包含历史对话的完整输入，并加入本地文件内容
      const fullInput = [fileContent, ...conversationHistory.map(item => `${item.role}: ${item.content}`)].join('\n');

      const stream = await model.stream(fullInput);

      let answer = '';
      for await (const str of stream) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(str);
        }
        answer += str;
      }
      // 将回答添加到对话历史
      conversationHistory.push({ role: 'assistant', content: answer });
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