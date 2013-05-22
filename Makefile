test:
	@./node_modules/.bin/mocha \
		--reporter spec \
		--bail \
		--timeout 5s \
		--require test/_common.js

clean:
	@./bin/clean.sh

bench:
	@./bin/bench.sh

.PHONY: test
.PHONY: clean
.PHONY: bench