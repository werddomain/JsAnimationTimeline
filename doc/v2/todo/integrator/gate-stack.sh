#!/bin/bash
# Gate each commit of a local stack in order: gate-stack.sh <sha>...
S=/tmp/claude-0/-home-claude-jsanimationtimeline/dcf34e69-efc7-5ef3-bb60-eb5ceb63c99b/scratchpad
cd /home/claude/jsanimationtimeline
for c in "$@"; do
  git checkout -q --detach "$c" || exit 1
  bash $S/gate.sh $S/gate-stk-$c.txt
  cp $S/gate-test.log $S/gate-test-$c.log; cp $S/gate-e2e.log $S/gate-e2e-$c.log
  echo "### $c"; cat $S/gate-stk-$c.txt
done
