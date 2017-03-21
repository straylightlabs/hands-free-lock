#!/usr/bin/env python

import signal
import sys
import time

from pirc522 import RFID

WHITELIST = [
    'https://straylight.jp/one/00001',
    'https://straylight.jp/one/00002',
    'https://straylight.jp/one/vk2g7',
    'https://straylight.jp/one/b4cz6',
    'https://straylight.jp/one/6ej7n',
    'https://straylight.jp/one/u36bx',
    'https://straylight.jp/one/9y2tk',
    'https://straylight.jp/one/33fxm',
    'https://straylight.jp/one/ujv3w',
    'https://straylight.jp/one/zz6n7',
]

loop = True
rfid = RFID()
util = rfid.util()

def end_read(signal, frame):
    global loop
    print("\nCtrl+C captured, ending read.")
    loop = False
    rfid.cleanup()

signal.signal(signal.SIGINT, end_read)

print >> sys.stderr, 'scanning'

while loop:
    (not_found, data) = rfid.request()
    if not_found:
	continue

    print >> sys.stderr, 'found'

    (error, uid) = rfid.anticoll()
    if error:
	continue

    util.set_tag(uid)
    print >> sys.stderr, 'found2'

    chars = []
    num_chars_to_skip = 28
    done_reading = False

    for i in xrange(16):
	(error, data) = rfid.read(i * 4)
	if error:
	    break
	for c in data:
	    if num_chars_to_skip > 0:
		num_chars_to_skip -= 1
		continue
            if c >= 200:
                # TODO(ryok): Investigate why 254 comes at the end of URL
                continue
	    if c == 0:
		done_reading = True
		break
	    chars.append(chr(c))
	if done_reading:
	    address = ''.join(chars)
            print('NFC', address)
            if address in WHITELIST:
                print('NFC', address)
                sys.stdout.flush()
	    break

    #time.sleep(5)

