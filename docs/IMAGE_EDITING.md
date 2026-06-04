# Image Editing

## 局部涂抹编辑

局部编辑使用源图和 mask 共同提交。

## mask alpha 规则

- 建议只使用 alpha `0` 和 `255`
- 中间透明度可能导致上游行为不一致

## compatible 模式

`compatible` 模式会尽量保持与兼容接口的实际要求一致，重点照顾尺寸和 multipart 提交行为。

## original 模式风险

`original` 模式更依赖原始图尺寸与提交图尺寸保持一致，兼容代理上更容易暴露差异。

## 4K mask 兼容问题

- 4K 图编辑时更容易遇到大小和耗时限制
- 如果上游对 4K 编辑支持不稳定，先检查尺寸、mask 大小和负载状态
