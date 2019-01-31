NAMES=$(ls *.so)
for i in $NAMES; do
  rm $i
  ln -s rustlib/x86_64-unknown-linux-gnu/lib/$i $i
done

pushd rustlib/x86_64-unknown-linux-gnu/lib/
for i in $(ls *.so); do
  strip $i
done
popd