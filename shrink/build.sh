#!/usr/bin/env sh

set -eo pipefail

# Start in shrink/ even if run from root directory
pushd "$(dirname "$0")"

docker build . --tag rust-shrunk -f Dockerfile
docker rm rust-shrunk || true
docker create --name rust-shrunk rust-shrunk
docker cp rust-shrunk:/root/rust.tar .

popd