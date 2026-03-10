# TRouter 智能网关软件使用说明书

## 1. 软件概述
TRouter 是一款高性能的垂直领域大模型（LLM）API 网关系统。它聚合了全球主流的 AI 模型服务商（如 OpenAI, Azure, Anthropic, Groq 等），旨在为开发者和企业提供统一、可靠且低成本的 AI 基础设施接入方案。

本软件核心功能包括：
- **多模型聚合**：通过统一的 API 接口访问多种大模型。
- **智能路由**：基于价格、延迟和可用性自动选择最佳上游服务商。
- **费用管理**：支持预付费充值、余额预警及详细的账单查询。
- **企业级管理**：提供可视化控制台、API 密钥管理及请求审计日志。

## 2. 运行环境与安装
### 2.1 硬件要求
- CPU: 2核及以上
- 内存: 4GB及以上
- 硬盘: 20GB可用空间

### 2.2 软件环境
- 操作系统: Linux (推荐 Ubuntu 20.04+), Windows Server, macOS
- 依赖组件: Docker, Docker Compose

### 2.3 安装步骤
1. **获取代码**：
   下载软件安装包或拉取源代码。
2. **配置环境**：
   复制 `.env.example` 为 `.env`，并配置数据库连接、JWT 密钥等参数。
3. **启动服务**：
   在终端执行以下命令一键启动：
   ```bash
   docker-compose up -d
   ```
4. **访问系统**：
   启动成功后，通过浏览器访问 `http://localhost:80` (或服务器IP) 进入管理控制台。

## 3. 功能操作指南

### 3.1 用户注册与登录
1. 打开系统首页，点击“注册”按钮。
2. 输入邮箱、密码及手机号，完成验证码验证（支持 Cloudflare Turnstile 安全校验）。
3. 注册成功后，使用邮箱和密码登录系统。

### 3.2 控制台概览 (Dashboard)
登录后进入用户控制台，可查看：
- **当前余额**：实时显示的账户剩余额度。
- **API 调用统计**：近期请求量及消耗 Token 趋势图。
- **系统公告**：管理员发布的最新通知。

### 3.3 API 密钥管理
1. 进入“API Keys”菜单。
2. 点击“创建密钥”按钮，输入备注名称。
3. 系统将生成以 `sk-` 开头的密钥，请妥善保存（仅显示一次）。
4. 可随时禁用或删除已泄漏的密钥。

### 3.4 模型调用 (API 使用)
本系统完全兼容 OpenAI API 标准。
- **接口地址**: `http://<服务器IP>/v1/chat/completions`
- **认证方式**: Bearer Token (使用生成的 API Key)
- **示例代码 (Python)**:
  ```python
  import openai
  
  client = openai.OpenAI(
      base_url="http://localhost:80/v1",
      api_key="sk-xxxxxx"
  )
  
  response = client.chat.completions.create(
      model="gpt-3.5-turbo",
      messages=[{"role": "user", "content": "Hello"}]
  )
  print(response.choices[0].message.content)
  ```

### 3.5 充值与账单
1. 进入“Billing”菜单。
2. 点击“充值”，选择支付方式（支持支付宝/微信/加密货币等聚合支付）。
3. 支付完成后余额实时到账。
4. 在“Transactions”标签页可查看每一笔充值和消费记录。

### 3.6 管理员功能 (仅限管理员)
管理员账号登录后，侧边栏会多出“Admin”区域：
- **用户管理**：查看所有注册用户，进行禁用/解封或手动调整余额操作。
- **模型配置**：添加新的 AI 模型，配置上游服务商的 API Key 和路由权重。
- **系统设置**：配置系统全局参数，如注册开关、公告内容等。

## 4. 常见问题
- **Q: 为什么调用 API 返回 401 错误？**
  A: 请检查 API Key 是否正确，或余额是否充足。
- **Q: 如何切换不同的模型？**
  A: 在 API 请求的 `model` 参数中指定模型名称（如 `gpt-4`, `claude-3`），系统会自动路由。

---
版权所有 © 2026 TRouter Team
