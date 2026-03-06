# 部署 TRouter 到 1Panel 指南

本文档详细介绍如何将 TRouter 的后端（Go）和前端（React）部署到 1Panel 面板。

## 准备工作

1.  拥有一台安装了 1Panel 的 Linux 服务器。
2.  确保已在 1Panel 应用商店安装了 **OpenResty** (用于反向代理) 和 **PostgreSQL** (如果使用 Postgres 数据库)。
3.  确保本地已安装 Go 和 Node.js 环境（用于编译）。

---

## 方式一：Docker 部署后端 (推荐)

此方式将后端运行在 Docker 容器中，易于管理和升级。

### 1. 准备文件
在本地项目根目录，找到以下文件：
- `Dockerfile`
- `docker-compose.yml`
- `.env.example` (重命名为 `.env`)

### 2. 修改配置 (.env)
复制 `.env.example` 为 `.env`，并根据服务器环境修改配置：
```ini
# 数据库配置 (如果使用 1Panel 的 PostgreSQL，请填写容器内部连接地址或宿主机 IP)
DATABASE_URL="host=172.17.0.1 user=postgres password=yourpassword dbname=trouter port=5432 sslmode=disable"

# JWT 密钥
JWT_SECRET="your-secret-key"

# 其他配置...
```
> **注意**: 如果使用 SQLite，请确保 `docker-compose.yml` 中已挂载 `data` 目录。

### 3. 上传文件到服务器
在 1Panel 的 **主机 -> 文件** 管理中，创建一个目录 (例如 `/opt/trouter`)，并将上述文件上传到该目录。

### 4. 启动容器
在 1Panel 的 **容器 -> 编排** 中，点击 **创建编排**：
- **名称**: `trouter`
- **路径**: 选择 `/opt/trouter` (或者直接将 `docker-compose.yml` 内容粘贴到编辑器中)
- 点击 **确认** 或 **启动**。

容器启动后，后端将在 `8080` 端口监听。

### 5. 配置反向代理 (域名访问)
1.  在 1Panel **网站 -> 创建网站** -> **反向代理**。
2.  **主域名**: `api.yourdomain.com` (或者你的后端域名)。
3.  **代理地址**: `http://127.0.0.1:8080`。
4.  提交。

---

## 方式二：二进制部署后端 (Supervisor)

此方式直接在服务器运行编译好的二进制文件，性能略高，适合不想用 Docker 的场景。

### 1. 本地交叉编译
在 Windows/Mac 上编译 Linux 可执行文件：

**Windows (PowerShell):**
```powershell
$env:CGO_ENABLED="0"
$env:GOOS="linux"
$env:GOARCH="amd64"
go build -ldflags "-s -w" -o trouter-server cmd/gateway/main.go
```

**Mac/Linux:**
```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags "-s -w" -o trouter-server cmd/gateway/main.go
```

### 2. 上传文件
1.  在服务器创建目录 `/opt/trouter`。
2.  将编译好的 `trouter-server` 文件上传到该目录。
3.  将 `.env` 文件也上传到该目录。
4.  给予执行权限: `chmod +x /opt/trouter/trouter-server`。

### 3. 配置 Supervisor (进程守护)
1.  在 1Panel **主机 -> 进程守护 (Supervisor)** -> **添加守护进程**。
2.  **名称**: `trouter`
3.  **启动用户**: `root` (或创建专用用户)
4.  **运行目录**: `/opt/trouter`
5.  **启动命令**: `/opt/trouter/trouter-server`
6.  点击 **确认**。

确保状态显示为 **运行中**。

---

## 前端部署 (静态网站)

前端是纯静态文件，推荐使用 OpenResty (Nginx) 托管。

### 1. 本地编译
在 `web` 目录下运行：
```bash
npm install
npm run build
```
编译完成后，会生成 `web/dist` 目录。

### 2. 上传文件
1.  在 1Panel **网站 -> 创建网站** -> **静态网站**。
2.  **主域名**: `yourdomain.com` (前端域名)。
3.  **网站目录**: `/www/sites/yourdomain.com` (1Panel 默认路径)。
4.  创建成功后，进入该目录，删除默认文件，将本地 `web/dist` 目录下的**所有文件**上传到该目录。

### 3. 配置 Nginx 反向代理 (解决跨域)
为了让前端能访问后端 API，需要配置 Nginx 反向代理 `/api` 和 `/v1` 请求。

1.  在 1Panel **网站** 列表中，点击该网站的 **配置** -> **配置文件**。
2.  在 `server` 块中添加以下 location 配置：

```nginx
location /api {
    proxy_pass http://127.0.0.1:8080; # 后端地址
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /v1 {
    proxy_pass http://127.0.0.1:8080; # 后端地址
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# 防止前端路由刷新 404 (React Router)
location / {
    try_files $uri $uri/ /index.html;
}
```

3.  点击 **保存并重载**。

---

## 验证部署

1.  访问前端域名 `http://yourdomain.com`，应该能看到登录页面。
2.  尝试登录或注册，检查网络请求是否成功发往 `/api/...`。
3.  如果是 Docker 部署，可以通过 `docker logs trouter-backend` 查看后端日志。
4.  如果是 Supervisor 部署，可以在守护进程页面查看日志。
