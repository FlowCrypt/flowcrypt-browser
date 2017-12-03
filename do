#!/usr/bin/python3
# -*- coding: utf-8 -*-

import os
import sys

choices = [
	('c', 'chrome_pack', '\tpack chrome extension and run automated tests'),
	('f', 'firefox_pack', '\tpack firefox extension'),
	('fr', 'firefox_run', '\trun firefox extension'),
	('c2f', 'chrome_to_firefox', 'replace firefox code with chrome code'),
	('f2c', 'firefox_to_chrome', 'replace chrome code with firefox code'),
	('fu', 'firefox_upload', '\tsigned package to s3'),
	('lib', 'chrome_update_libs', 'very possibly a broken script'),
	('bsl', 'chrome_update_licence', 'update licence statements in all project files'),
]

if len(sys.argv) == 1:
    for c in choices:
        print('%s\t%s\t\t%s' % c)
    shortcut = input('')
    valid_choice = [c for c in choices if shortcut == c[0]]
    if not valid_choice:
        raise Exception('Unknown choice')
    command = valid_choice[0][1]
else:
    command = sys.argv[1]

os.system('../flowcrypt-script/browser/%s' % command)