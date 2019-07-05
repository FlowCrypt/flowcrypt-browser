#!/bin/bash

# not currently used

set -uo pipefail

N=0
until [ ${N} -ge 3 ]
do
	$@ # execute whatever commands in the command line arg
  EXITCODE=$?
	if [ "$EXITCODE" -eq 0 ]; then
    # success
    exit 0
  elif [ "$EXITCODE" -eq 1 ]; then
    # standard failure
    exit 1
  else
    # retriable failure eg errcode 2
    N=$[${N}+1]
    echo " ||||||||||||||||||||| ============= ----- SHELL SCRIPT RETRY $N FOR EXITCODE $EXITCODE ----- ============= |||||||||||||||||||||"
    sleep 5
  fi
done
