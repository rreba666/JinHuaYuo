<template>
  <view class="page-watermark" aria-hidden="true">
    <text class="page-watermark-text">今华有 | 技术支持</text>
  </view>
</template>

<style scoped>
.page-watermark {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 76rpx;
  padding: 18rpx 24rpx calc(26rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  pointer-events: none;
}

.page-watermark-text {
  color: rgba(118, 118, 118, .42);
  font-size: 22rpx;
  line-height: 1.4;
  letter-spacing: 1rpx;
  white-space: nowrap;
}
</style>
