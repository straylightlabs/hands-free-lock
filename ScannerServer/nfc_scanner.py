import signal
import time

from pirc522 import RFID

loop = True
rfid = RFID()
util = rfid.util()

def end_read(signal, frame):
    global loop
    print("\nCtrl+C captured, ending read.")
    loop = False
    rfid.cleanup()

signal.signal(signal.SIGINT, end_read)

print("Scanning...")

while loop:
    (not_found, data) = rfid.request()
    if not_found:
	continue

    (error, uid) = rfid.anticoll()
    if error:
	continue

    util.set_tag(uid)

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
	    print(''.join(chars))
	    break

    time.sleep(5)

