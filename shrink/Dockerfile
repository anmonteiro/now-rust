FROM amazonlinux

RUN yum update -y && yum upgrade -y && \
    yum install -y git curl sudo file && \
    yum groupinstall 'Development Tools' -y

RUN curl -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH=/root/.cargo/bin:$PATH

COPY shrink.sh /shrink.sh

RUN rm -r /root/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/
RUN rm -r /root/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/etc/
RUN rm -r /root/.cargo/git || true && rm -r /root/.cargo/registry || true

WORKDIR /root/.cargo/bin
RUN rm cargo-clippy cargo-fmt rls rust-gdb rust-lldb rustdoc rustfmt rustup

WORKDIR /root/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/
RUN rm rust-gdb rust-lldb rustdoc

RUN cd /root/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib && /shrink.sh

WORKDIR /root
RUN rm -r .multirust && mv .rustup .multirust

# TODO: ?!
RUN rm .multirust/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/codegen-backends/librustc_codegen_llvm-emscripten.so
# RUN rm .multirust/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/lib/libtest*
RUN strip .multirust/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo
RUN strip .multirust/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/bin/rust-lld
RUN strip .cargo/bin/cargo
RUN strip .cargo/bin/rustc
RUN strip .multirust/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/codegen-backends/librustc_codegen_llvm-llvm.so

RUN  tar -cf rust.tar .cargo/ .multirust/