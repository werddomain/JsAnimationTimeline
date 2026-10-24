#!/bin/bash
# Integration gate: run from repo root; writes a summary to $1
OUT=$1; S=/tmp/claude-0/-home-claude-jsanimationtimeline/dcf34e69-efc7-5ef3-bb60-eb5ceb63c99b/scratchpad
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
{
rm -rf packages/*/dist packages/*/dist-demo demo/*/dist*
npm ci --silent >$S/gate-ci.log 2>&1; echo "ci=$?"
echo "lint: $(npm run lint 2>&1 | grep -E 'problems' | tail -1)"
echo "tsc errors: $(npm run typecheck 2>&1 | grep -c 'error TS')"
npm test >$S/gate-test.log 2>&1; echo "test=$?"; grep -E '^Tests:|FAIL' $S/gate-test.log
npm run build >$S/gate-build.log 2>&1; echo "build=$?"
npm run build:demo >>$S/gate-build.log 2>&1; echo "demo=$?"
if [ -d dotnet ]; then dotnet build dotnet/JsTimeline.sln -c Release >$S/gate-dotnet.log 2>&1; echo "dotnet build=$?"; grep -E 'Warning\(s\)|Error\(s\)' $S/gate-dotnet.log; dotnet test dotnet/JsTimeline.sln -c Release --no-build 2>&1 | grep -E 'Passed!|Failed!'; fi
PLAYWRIGHT_BROWSERS_PATH=$S/pw npm run test:e2e >$S/gate-e2e.log 2>&1; echo "e2e=$?"; grep -E ' passed| failed| flaky' $S/gate-e2e.log | tail -3
git status --short | grep -v '^??' | head -5
echo "tree=$(git rev-parse HEAD^{tree})"
} > $OUT 2>&1
echo done >> $OUT
