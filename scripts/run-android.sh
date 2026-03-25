#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${ANDROID_HOME:-}" && -d "${HOME}/Android/Sdk" ]]; then
  export ANDROID_HOME="${HOME}/Android/Sdk"
fi

if [[ -z "${ANDROID_SDK_ROOT:-}" && -n "${ANDROID_HOME:-}" ]]; then
  export ANDROID_SDK_ROOT="${ANDROID_HOME}"
fi

if [[ -n "${ANDROID_HOME:-}" ]]; then
  export PATH="${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/emulator:${PATH}"
fi

exec npx expo start --android
