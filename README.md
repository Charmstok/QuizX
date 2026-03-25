# QuizX

QuizX 是一个面向 Android / iOS 的题库学习应用原型，当前仓库已搭好最小可运行的 Expo + React Native + TypeScript 界面。

## 当前已实现

- 首页概览
- SQLite 题库表 / 题目表初始化
- 题库列表从 SQLite 读取
- `答题模式` / `背诵模式` / `错题本` 三个模块入口
- 系统文件选择器读取本地 Excel
- Excel 行数据统一格式化
- 导入预览页与校验提示
- 预览确认后写入 SQLite
- 底部导航切换

当前版本只演示界面，不包含以下真实能力：

- 真正的答题逻辑
- 错题记录与复习算法
- 微信 Excel 导入

## 技术栈

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Expo SQLite
- Expo Document Picker
- SheetJS `xlsx`

## 标准导入格式

当前导入只支持这一种标准 Excel 模板，不再兼容旧版的 `题库名称 / 题目 / 选项A~D / 解析 / 标签` 模板。

标准工作表：

- `判断题`
- `单选题`
- `多选题`
- `填空`

非空工作表的第一行表头必须使用下面这 6 列：

- `题干`
- `选项`
- `答案`
- `难度`
- `题型`
- `试题解析`

标准样式来自当前已验证文件 `/home/charms/Downloads/安全责任制.xls`。

字段说明：

- `题干`：题目正文
- `选项`：单列选项文本，使用 `#` 分隔多个选项
- `答案`：判断题使用 `对/错`，单选题使用 `A`，多选题使用 `AB`、`ABC` 这类字母串
- `难度`：当前先读取并校验表头，暂未入库使用
- `题型`：建议与所在工作表一致，如 `判断题`、`单选题`、`多选题`、`填空`
- `试题解析`：题目解析文本，可为空

`选项` 列示例：

- `对#错`
- `A、明日圆舟#B、源神#C、亡者荣耀`

当前支持的题型固定为：

- `判断`
- `单选`
- `多选`
- `填空`

导入规则：

- 一个 Excel 文件会被当作一个题库导入
- 题库名默认使用 Excel 文件名
- 多个工作表会合并进入同一个导入预览
- 非空工作表缺少标准表头时会直接报格式错误
- 预览页存在错误行时，当前版本不会允许直接入库
- 判断题答案支持 `对/错`，同时兼容 `A/B`
- 单选/多选答案使用选项字母

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
- 点击 `本地 Excel 导入` 按钮，是否能打开系统文件选择器
- 选择 Excel 后，是否能进入导入预览页
- 预览页里的题型、选项、答案映射是否正确
- 点击 `确认导入到 SQLite` 后，首页题库数量和题目总数是否更新
- 点击 `微信 Excel 导入` 按钮，是否仍显示未接入提示
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

1. 实现答题模式的最小闭环
2. 再补背诵模式和错题本
3. 完善题库详情页和题目浏览
4. 增加重复导入处理与批量导入体验
5. 后续再接微信 Excel 导入
