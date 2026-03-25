# QuizX

QuizX 是一个面向 Android / iOS 的题库学习应用原型，当前仓库已搭好最小可运行的 Expo + React Native + TypeScript 界面。

## 当前已实现

- 首页概览
- 题库列表占位数据
- `答题模式` / `背诵模式` / `错题本` 三个模块入口
- `本地 Excel 导入` / `微信 Excel 导入` 的占位按钮
- 底部导航切换

当前版本只演示界面，不包含以下真实能力：

- Excel 文件导入
- SQLite 持久化
- 真正的答题逻辑
- 错题记录与复习算法

## 技术栈

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript

## 本地运行

推荐环境：

- Node.js 20 LTS
- npm 10+

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run start
```

也可以直接使用：

```bash
npm run android
npm run ios
```

如果你在 Linux 上已经通过 Android Studio 安装了 SDK，但路径位于 `~/Android/Sdk`，当前仓库的 `npm run android` 会自动识别这个目录并补上 `adb` 路径。

## 如何测试这个最小可运行界面

### 方式一：用 Expo Go 测试真机

1. 手机上安装 Expo Go
2. 电脑运行：

```bash
npm run start
```

3. 终端或浏览器打开 Expo DevTools 后，使用手机扫码进入
4. 进入应用后，重点检查这些点：

- 首页是否正常显示标题、概览卡片和题库列表
- 点击 `本地 Excel 导入` 按钮，是否弹出占位提示
- 点击 `微信 Excel 导入` 按钮，是否弹出占位提示
- 点击 `答题模式` / `背诵模式` / `错题本` 卡片，是否能切换到对应占位页
- 点击底部导航，是否能在 `首页 / 答题 / 背诵 / 错题本` 之间切换
- 从占位页点击 `回到首页`，是否能正常返回

### 方式二：Android 模拟器测试

1. 安装 Android Studio，并创建一个 Android 模拟器
2. 启动模拟器
3. 在项目目录执行：

```bash
npm run android
```

4. 验证点与真机测试一致

如果仍提示找不到 Android SDK 或 `adb`，先自查这两个命令：

```bash
echo $ANDROID_HOME
which adb
```

在你当前这台机器上，正确的 SDK 路径应为：

```bash
/home/charms/Android/Sdk
```

如果你想手动设置，也可以先执行：

```bash
export ANDROID_HOME=/home/charms/Android/Sdk
export ANDROID_SDK_ROOT=/home/charms/Android/Sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
```

### 方式三：iOS 模拟器测试

iOS 模拟器只能在 macOS + Xcode 环境下运行。

1. 打开 iOS 模拟器
2. 在项目目录执行：

```bash
npm run ios
```

3. 检查页面渲染和导航切换是否正常

## 下一步建议

建议按这个顺序继续实现：

1. 接入 SQLite，先把题库和题目表建起来
2. 接入系统文件选择器，完成本地 Excel 读取
3. 统一题库导入格式，增加导入预览页
4. 实现答题模式的最小闭环
5. 再补背诵模式和错题本
