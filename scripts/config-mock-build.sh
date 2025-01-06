# copy build to new folder and replace all usages of :8001 with appropriate mock port
BUILD_PATH=./build/test/mock-builds/port-$2-$(openssl rand -hex 12)
mkdir -p $BUILD_PATH
cp -r ./$1/* $BUILD_PATH
grep "\[TEST_REPLACEABLE_MOCK_PORT\]" $BUILD_PATH -lr | xargs sed -i.bak -e "s/\[TEST_REPLACEABLE_MOCK_PORT\]/$2/g"
echo $BUILD_PATH