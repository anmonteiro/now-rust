FROM debian:9

RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y git curl sudo file build-essential musl-tools

RUN curl -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH=/root/.cargo/bin:$PATH

RUN rustup target add x86_64-unknown-linux-musl

RUN mkdir /compile
WORKDIR /compile

RUN mkdir src && touch src/lib.rs
COPY Cargo.toml .

RUN cargo build --target=x86_64-unknown-linux-musl --release

COPY . .

RUN cargo build --target=x86_64-unknown-linux-musl --release --example now
RUN mv /compile/target/x86_64-unknown-linux-musl/release/examples/now /main.exe