BUILD_PATH=./build/test/mock-builds/port-$2-$(openssl rand -hex 12)
mkdir -p $BUILD_PATH
cp -r ./$1/* $BUILD_PATH
grep ":8001" $BUILD_PATH -lr | xargs sed -i '.bak' "s/\:8001/\:$2/g"
grep ":8001" $BUILD_PATH -lr
# echo $BUILD_PATH