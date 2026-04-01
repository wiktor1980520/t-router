# TRouter

TRouter 是一个面向开发者与中小团队的多模型 AI API 网关平台。

它以 OpenAI 兼容接口作为统一入口，帮助用户以更低的接入成本使用多个主流大模型，并通过多供应商路由、失败回退、成本控制、计费审计和管理后台能力，把“模型接入”升级为“可稳定运营的 AI 平台能力”。

## 一句话介绍

> 一个稳定、低门槛、可运营的多模型 AI API 网关平台。

## 为什么是 TRouter

- 用一个兼容接口统一接入多个模型
- 用路由、回退和健康检查提升稳定性
- 用计费、账单、审计和后台能力支撑商业化
- 用邀请码、配置中心和运营能力帮助平台增长

## 核心特点

- 统一 OpenAI 兼容接口接入
- 聚合多个上游模型供应商
- 支持智能路由、失败回退、健康检查
- 内置用户、API Key、余额、账单、审计能力
- 提供管理后台、系统配置、邀请码与运营能力

## 适用场景

- 独立开发者快速接入多个模型
- AI 应用团队做统一网关与成本控制
- 中小团队搭建自己的 AI API 平台
- 面向客户提供可计费、可管理的模型服务

## 当前支持

- OpenAI-compatible
- Claude / Anthropic
- Gemini
- Kimi、GLM、DeepSeek 等 OpenAI 兼容模型

## 项目结构

```text
cmd/gateway            服务入口
internal/api           API 与后台接口
internal/router        路由与健康检查
internal/provider      上游模型适配层
internal/models        数据模型
web/                   前端控制台
docs/                  产品、规划、运营、发布文档
```

## 快速了解

- 看产品定位：[产品定位与规划运营建议.md](file:///d:/TRouter/docs/产品定位与规划运营建议.md)
- 看版本执行：[1.0版本执行计划.md](file:///d:/TRouter/docs/1.0版本执行计划.md)
- 看周排期：[1.0按周排期任务清单.md](file:///d:/TRouter/docs/1.0按周排期任务清单.md)
- 看上线准备：[1.0上线前检查清单.md](file:///d:/TRouter/docs/1.0上线前检查清单.md)
- 看商业化运营：[运营与商业化落地清单.md](file:///d:/TRouter/docs/运营与商业化落地清单.md)
- 看官网文案：[项目简介与官网文案.md](file:///d:/TRouter/docs/项目简介与官网文案.md)
- 看完整文档导航：[docs/README.md](file:///d:/TRouter/docs/README.md)

## 快速开始

### 后端

```bash
docker compose -f docker-compose.local.yml up -d
```

```bash
go run cmd/gateway/main.go
```

### 前端

```bash
cd web
npm install
npm run dev
```

### 默认访问

- 前端：`http://localhost:5173`
- 后端：`http://localhost:8080`

## 项目定位

TRouter 不只是一个模型转发层，更是一套围绕 AI API 使用场景构建的商业化基础设施：

- 一个接口统一接入多个模型
- 多供应商稳定路由
- 成本优化与利润控制
- 可计费、可审计、可运营

## 当前能力

- OpenAI-compatible 接入
- Claude / Anthropic Provider
- Gemini Provider
- 多供应商路由与失败回退
- 用户注册登录、API Key 管理
- 余额扣费、交易记录、审计日志
- 系统配置、邀请码管理、管理后台

## 文档导航

- [docs/README.md](file:///d:/TRouter/docs/README.md)
- [产品定位与规划运营建议.md](file:///d:/TRouter/docs/产品定位与规划运营建议.md)
- [1.0版本执行计划.md](file:///d:/TRouter/docs/1.0版本执行计划.md)
- [1.0按周排期任务清单.md](file:///d:/TRouter/docs/1.0按周排期任务清单.md)
- [1.0上线前检查清单.md](file:///d:/TRouter/docs/1.0上线前检查清单.md)
- [运营与商业化落地清单.md](file:///d:/TRouter/docs/运营与商业化落地清单.md)
- [项目简介与官网文案.md](file:///d:/TRouter/docs/项目简介与官网文案.md)
- [投资人合作伙伴介绍提纲.md](file:///d:/TRouter/docs/投资人合作伙伴介绍提纲.md)
- [10页PPT逐页文案.md](file:///d:/TRouter/docs/10页PPT逐页文案.md)
- [10页PPT完整演讲稿.md](file:///d:/TRouter/docs/10页PPT完整演讲稿.md)
- [官网首页信息架构.md](file:///d:/TRouter/docs/官网首页信息架构.md)
- [包月卡专项方案.md](file:///d:/TRouter/docs/包月卡专项方案.md)
- [团队版与企业版规划.md](file:///d:/TRouter/docs/团队版与企业版规划.md)
- [数据看板指标定义.md](file:///d:/TRouter/docs/数据看板指标定义.md)
- [支付与账务专项方案.md](file:///d:/TRouter/docs/支付与账务专项方案.md)
- [邀请码与渠道增长专项方案.md](file:///d:/TRouter/docs/邀请码与渠道增长专项方案.md)
- [版本发布日志与复盘模板.md](file:///d:/TRouter/docs/版本发布日志与复盘模板.md)
- [商务合作FAQ与标准话术.md](file:///d:/TRouter/docs/商务合作FAQ与标准话术.md)
- [企业客户PoC与交付流程.md](file:///d:/TRouter/docs/企业客户PoC与交付流程.md)
- [数据看板页面原型说明.md](file:///d:/TRouter/docs/数据看板页面原型说明.md)
- [定价与套餐矩阵.md](file:///d:/TRouter/docs/定价与套餐矩阵.md)

## 推荐对外表达

> TRouter：一个稳定、低门槛、可运营的多模型 AI API 网关平台。

## 未来方向

TRouter 的长期目标，不是做“又一个兼容层”，而是做成一个面向开发者和中小团队的 AI 网关商业平台：

- 统一接入
- 稳定路由
- 可控成本
- 可持续运营

## 说明

如果你希望快速了解项目：

- 看整体方向：先读 [产品定位与规划运营建议.md](file:///d:/TRouter/docs/产品定位与规划运营建议.md)
- 看执行排期：读 [1.0按周排期任务清单.md](file:///d:/TRouter/docs/1.0按周排期任务清单.md)
- 看上线准备：读 [1.0上线前检查清单.md](file:///d:/TRouter/docs/1.0上线前检查清单.md)
- 看对外介绍：读 [项目简介与官网文案.md](file:///d:/TRouter/docs/项目简介与官网文案.md)
- 看融资/合作表达：读 [投资人合作伙伴介绍提纲.md](file:///d:/TRouter/docs/投资人合作伙伴介绍提纲.md) 和 [10页PPT逐页文案.md](file:///d:/TRouter/docs/10页PPT逐页文案.md)
- 看现场讲解：读 [10页PPT完整演讲稿.md](file:///d:/TRouter/docs/10页PPT完整演讲稿.md)
- 看官网结构：读 [官网首页信息架构.md](file:///d:/TRouter/docs/官网首页信息架构.md)
- 看套餐设计：读 [包月卡专项方案.md](file:///d:/TRouter/docs/包月卡专项方案.md)
- 看中长期版本规划：读 [团队版与企业版规划.md](file:///d:/TRouter/docs/团队版与企业版规划.md)
- 看数据看板：读 [数据看板指标定义.md](file:///d:/TRouter/docs/数据看板指标定义.md)
- 看支付与账务：读 [支付与账务专项方案.md](file:///d:/TRouter/docs/支付与账务专项方案.md)
- 看渠道增长：读 [邀请码与渠道增长专项方案.md](file:///d:/TRouter/docs/邀请码与渠道增长专项方案.md)
- 看发布复盘：读 [版本发布日志与复盘模板.md](file:///d:/TRouter/docs/版本发布日志与复盘模板.md)
- 看商务沟通：读 [商务合作FAQ与标准话术.md](file:///d:/TRouter/docs/商务合作FAQ与标准话术.md)
- 看企业合作交付：读 [企业客户PoC与交付流程.md](file:///d:/TRouter/docs/企业客户PoC与交付流程.md)
- 看 dashboard 页面设计：读 [数据看板页面原型说明.md](file:///d:/TRouter/docs/数据看板页面原型说明.md)
- 看价格框架：读 [定价与套餐矩阵.md](file:///d:/TRouter/docs/定价与套餐矩阵.md)



Create By  卓然信息技术（深圳）有限公司   wiktor1982520@gmail.com
