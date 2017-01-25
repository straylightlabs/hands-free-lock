#!/usr/bin/env python

import subprocess

WHITELIST = [
    'F0:2A;63:5C;E3:E5',  # SLBeacon00001
    'EB:B4:73:21:AC:3C',  # SLBeacon00002 -> Daniel
    'D7:AF:DA:DF:43:85',  # SLBeacon00003
]

lescan = subprocess.Popen(["hcitool", "lescan", "--duplicate"], stdout=subprocess.PIPE)

while True:
    line = proc.stdout.readline()
    if line:
	address = line.split()[0]
	if address in WHITELIST:
            print('BLE', address)
    else:
    	break
