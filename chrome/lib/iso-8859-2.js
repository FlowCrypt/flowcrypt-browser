/*! https://mths.be/iso-8859-2 v0.1.2 by @mathias | MIT license */
;(function(root) {

	// Detect free variables `exports`.
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`.
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js/io.js or Browserified code,
	// and use it as `root`.
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	var object = {};
	var hasOwnProperty = object.hasOwnProperty;
	var stringFromCharCode = String.fromCharCode;

	var INDEX_BY_CODE_POINT = {'128':0,'129':1,'130':2,'131':3,'132':4,'133':5,'134':6,'135':7,'136':8,'137':9,'138':10,'139':11,'140':12,'141':13,'142':14,'143':15,'144':16,'145':17,'146':18,'147':19,'148':20,'149':21,'150':22,'151':23,'152':24,'153':25,'154':26,'155':27,'156':28,'157':29,'158':30,'159':31,'160':32,'164':36,'167':39,'168':40,'173':45,'176':48,'180':52,'184':56,'193':65,'194':66,'196':68,'199':71,'201':73,'203':75,'205':77,'206':78,'211':83,'212':84,'214':86,'215':87,'218':90,'220':92,'221':93,'223':95,'225':97,'226':98,'228':100,'231':103,'233':105,'235':107,'237':109,'238':110,'243':115,'244':116,'246':118,'247':119,'250':122,'252':124,'253':125,'258':67,'259':99,'260':33,'261':49,'262':70,'263':102,'268':72,'269':104,'270':79,'271':111,'272':80,'273':112,'280':74,'281':106,'282':76,'283':108,'313':69,'314':101,'317':37,'318':53,'321':35,'322':51,'323':81,'324':113,'327':82,'328':114,'336':85,'337':117,'340':64,'341':96,'344':88,'345':120,'346':38,'347':54,'350':42,'351':58,'352':41,'353':57,'354':94,'355':126,'356':43,'357':59,'366':89,'367':121,'368':91,'369':123,'377':44,'378':60,'379':47,'380':63,'381':46,'382':62,'711':55,'728':34,'729':127,'731':50,'733':61};
	var INDEX_BY_POINTER = {'0':'\x80','1':'\x81','2':'\x82','3':'\x83','4':'\x84','5':'\x85','6':'\x86','7':'\x87','8':'\x88','9':'\x89','10':'\x8A','11':'\x8B','12':'\x8C','13':'\x8D','14':'\x8E','15':'\x8F','16':'\x90','17':'\x91','18':'\x92','19':'\x93','20':'\x94','21':'\x95','22':'\x96','23':'\x97','24':'\x98','25':'\x99','26':'\x9A','27':'\x9B','28':'\x9C','29':'\x9D','30':'\x9E','31':'\x9F','32':'\xA0','33':'\u0104','34':'\u02D8','35':'\u0141','36':'\xA4','37':'\u013D','38':'\u015A','39':'\xA7','40':'\xA8','41':'\u0160','42':'\u015E','43':'\u0164','44':'\u0179','45':'\xAD','46':'\u017D','47':'\u017B','48':'\xB0','49':'\u0105','50':'\u02DB','51':'\u0142','52':'\xB4','53':'\u013E','54':'\u015B','55':'\u02C7','56':'\xB8','57':'\u0161','58':'\u015F','59':'\u0165','60':'\u017A','61':'\u02DD','62':'\u017E','63':'\u017C','64':'\u0154','65':'\xC1','66':'\xC2','67':'\u0102','68':'\xC4','69':'\u0139','70':'\u0106','71':'\xC7','72':'\u010C','73':'\xC9','74':'\u0118','75':'\xCB','76':'\u011A','77':'\xCD','78':'\xCE','79':'\u010E','80':'\u0110','81':'\u0143','82':'\u0147','83':'\xD3','84':'\xD4','85':'\u0150','86':'\xD6','87':'\xD7','88':'\u0158','89':'\u016E','90':'\xDA','91':'\u0170','92':'\xDC','93':'\xDD','94':'\u0162','95':'\xDF','96':'\u0155','97':'\xE1','98':'\xE2','99':'\u0103','100':'\xE4','101':'\u013A','102':'\u0107','103':'\xE7','104':'\u010D','105':'\xE9','106':'\u0119','107':'\xEB','108':'\u011B','109':'\xED','110':'\xEE','111':'\u010F','112':'\u0111','113':'\u0144','114':'\u0148','115':'\xF3','116':'\xF4','117':'\u0151','118':'\xF6','119':'\xF7','120':'\u0159','121':'\u016F','122':'\xFA','123':'\u0171','124':'\xFC','125':'\xFD','126':'\u0163','127':'\u02D9'};

	// https://encoding.spec.whatwg.org/#error-mode
	var error = function(codePoint, mode) {
		if (mode == 'replacement') {
			return '\uFFFD';
		}
		if (codePoint != null && mode == 'html') {
			return '&#' + codePoint + ';';
		}
		// Else, `mode == 'fatal'`.
		throw Error();
	};

	// https://encoding.spec.whatwg.org/#single-byte-decoder
	var decode = function(input, options) {
		var mode;
		if (options && options.mode) {
			mode = options.mode.toLowerCase();
		}
		// “An error mode […] is either `replacement` (default) or `fatal` for a
		// decoder.”
		if (mode != 'replacement' && mode != 'fatal') {
			mode = 'replacement';
		}
		var length = input.length;
		var index = -1;
		var byteValue;
		var pointer;
		var result = '';
		while (++index < length) {
			byteValue = input.charCodeAt(index);
			// “If `byte` is in the range `0x00` to `0x7F`, return a code point whose
			// value is `byte`.”
			if (byteValue >= 0x00 && byteValue <= 0x7F) {
				result += stringFromCharCode(byteValue);
				continue;
			}
			// “Let `code point` be the index code point for `byte − 0x80` in index
			// `single-byte`.”
			pointer = byteValue - 0x80;
			if (hasOwnProperty.call(INDEX_BY_POINTER, pointer)) {
				// “Return a code point whose value is `code point`.”
				result += INDEX_BY_POINTER[pointer];
			} else {
				// “If `code point` is `null`, return `error`.”
				result += error(null, mode);
			}
		}
		return result;
	};

	// https://encoding.spec.whatwg.org/#single-byte-encoder
	var encode = function(input, options) {
		var mode;
		if (options && options.mode) {
			mode = options.mode.toLowerCase();
		}
		// “An error mode […] is either `fatal` (default) or `HTML` for an
		// encoder.”
		if (mode != 'fatal' && mode != 'html') {
			mode = 'fatal';
		}
		var length = input.length;
		var index = -1;
		var codePoint;
		var pointer;
		var result = '';
		while (++index < length) {
			codePoint = input.charCodeAt(index);
			// “If `code point` is in the range U+0000 to U+007F, return a byte whose
			// value is `code point`.”
			if (codePoint >= 0x00 && codePoint <= 0x7F) {
				result += stringFromCharCode(codePoint);
				continue;
			}
			// “Let `pointer` be the index pointer for `code point` in index
			// `single-byte`.”
			if (hasOwnProperty.call(INDEX_BY_CODE_POINT, codePoint)) {
				pointer = INDEX_BY_CODE_POINT[codePoint];
				// “Return a byte whose value is `pointer + 0x80`.”
				result += stringFromCharCode(pointer + 0x80);
			} else {
				// “If `pointer` is `null`, return `error` with `code point`.”
				result += error(codePoint, mode);
			}
		}
		return result;
	};

	var iso88592 = {
		'encode': encode,
		'decode': decode,
		'labels': [
			'csisolatin2',
			'iso-8859-2',
			'iso-ir-101',
			'iso8859-2',
			'iso88592',
			'iso_8859-2',
			'iso_8859-2:1987',
			'l2',
			'latin2'
		],
		'version': '0.1.2'
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define(function() {
			return iso88592;
		});
	}	else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js, io.js or RingoJS v0.8.0+
			freeModule.exports = iso88592;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (var key in iso88592) {
				iso88592.hasOwnProperty(key) && (freeExports[key] = iso88592[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.iso88592 = iso88592;
	}

}(this));
