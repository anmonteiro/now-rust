FROM amazonlinux

RUN yum update -y && yum upgrade -y && \
    yum install -y git curl sudo file && \
    yum groupinstall 'Development Tools' -y

RUN curl -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH=/root/.cargo/bin:$PATH

RUN mkdir /compile

WORKDIR /compile

RUN mkdir src && touch src/lib.rs

COPY Cargo.toml .

RUN cargo build --release

COPY . .

RUN cargo build --release --example now
RUN mv /compile/target/release/examples/now /main.exe