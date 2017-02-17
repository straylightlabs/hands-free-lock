#!/usr/bin/env python

import sys
import requests

from subprocess import PIPE, Popen
from threading  import Thread
from Queue import Queue, Empty

ON_POSIX = 'posix' in sys.builtin_module_names

def enqueue_output(out, queue):
    for line in iter(out.readline, b''):
        queue.put(line)
    out.close()

p = Popen(['hcitool', 'lescan', '--duplicate'], stdout=PIPE, bufsize=1, close_fds=ON_POSIX)
q = Queue()
t = Thread(target=enqueue_output, args=(p.stdout, q))
t.daemon = True  # thread dies with the program
t.start()

def post_scan(mac_address, device_name):
    data = {"type": "ble", "rssi": -100, "macAddress": mac_address, "deviceName": device_name}
    requests.post('http://192.168.0.5:8080/report', data=data)

while True:
    try:
        line = q.get_nowait()
    except Empty:
        continue
    else:
	parts = line.split()
        mac_address = parts[0]
        device_name = parts[1]
        if device_name.startswith('SLBeacon'):
            post_scan(mac_address, device_name)
