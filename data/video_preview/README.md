# VoxTrace video dataset preview

The `download/` folder contains a local copy of the public preview from
[UniDataPro's DeepFake Videos Dataset](https://huggingface.co/datasets/UniDataPro/deepfake-videos-dataset).
It is marked **CC BY-NC-ND 4.0**. The dataset card describes this as a limited
preview; check the source terms before any reuse or redistribution.

This copy contains five generated clips under `deepfake/` and five corresponding
source clips under `video/` (about 69 MB total). It is for local inspection only:
it is far too small and narrow to train, validate, or claim performance for a
deepfake detector. VoxTrace does not load it during inference, and it has not
been used to create model weights. Video uploads remain `UNSCORED` until
appropriately licensed, sufficiently representative data and trained weights
are supplied.

The source README and CSV metadata are included in `download/`. The large media
files are ignored by Git and remain local to this checkout.
