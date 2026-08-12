#!/bin/bash
# v3: slower scrolls, typed center text, positioned two-beat card captions. ~46s.
set -e
cd /tmp/promo
FPS=30
TD=0.4


# fadescene <bgseq> <bgfps> <overlay> <fadein_at> <dur> <out>
fadescene () {
  BGSEQ=$1; BF=$2; OV=$3; FI=$4; DUR=$5; OUT=$6
  ffmpeg -y -loglevel error \
    -framerate "$BF" -i "$BGSEQ/f%04d.png" \
    -loop 1 -t "$DUR" -i "$OV" \
    -filter_complex "\
[0:v]fps=$FPS,tpad=stop_mode=clone:stop_duration=$DUR,trim=duration=$DUR,scale=1920:1080,setsar=1[bg];\
[1:v]format=rgba,fade=in:st=$FI:d=0.6:alpha=1[tx];\
[bg][tx]overlay=0:0:format=auto,format=yuv420p,trim=duration=$DUR[v]" \
    -map "[v]" -r $FPS -c:v libx264 -preset medium -crf 18 "$OUT"
  echo "built $OUT ($DUR s)"
}

# typedscene <bgseq> <bgfps> <textseq> <textfps> <dur> <out>
typedscene () {
  BGSEQ=$1; BF=$2; TSEQ=$3; TF=$4; DUR=$5; OUT=$6
  ffmpeg -y -loglevel error \
    -framerate "$BF" -i "$BGSEQ/f%04d.png" \
    -framerate "$TF" -i "$TSEQ/f%04d.png" \
    -filter_complex "\
[0:v]fps=$FPS,tpad=stop_mode=clone:stop_duration=$DUR,trim=duration=$DUR,scale=1920:1080,setsar=1[bg];\
[1:v]fps=$FPS,tpad=stop_mode=clone:stop_duration=$DUR,trim=duration=$DUR,format=rgba,fade=in:st=0.5:d=0.35:alpha=1[tx];\
[bg][tx]overlay=0:0:format=auto,format=yuv420p,trim=duration=$DUR[v]" \
    -map "[v]" -r $FPS -c:v libx264 -preset medium -crf 18 "$OUT"
  echo "built $OUT ($DUR s)"
}

# cardscene <bgseq> <bgfps> <cardA> <cardB> <dur> <switch> <out>
cardscene () {
  BGSEQ=$1; BF=$2; CA=$3; CB=$4; DUR=$5; SW=$6; OUT=$7
  AOUT=$(python3 -c "print(round($SW-0.45,2))")
  BIN=$(python3 -c "print(round($SW,2))")
  BOUT=$(python3 -c "print(round($DUR-0.55,2))")
  ffmpeg -y -loglevel error \
    -framerate "$BF" -i "$BGSEQ/f%04d.png" \
    -loop 1 -t "$DUR" -i "$CA" \
    -loop 1 -t "$DUR" -i "$CB" \
    -filter_complex "\
[0:v]fps=$FPS,tpad=stop_mode=clone:stop_duration=$DUR,trim=duration=$DUR,scale=1920:1080,setsar=1[bg];\
[1:v]format=rgba,fade=in:st=0.45:d=0.4:alpha=1,fade=out:st=$AOUT:d=0.4:alpha=1[ca];\
[2:v]format=rgba,fade=in:st=$BIN:d=0.4:alpha=1,fade=out:st=$BOUT:d=0.45:alpha=1[cb];\
[bg][ca]overlay=x=0:y='40*pow(1-min(1,max(0,(t-0.45)/0.5)),2)':format=auto[m];\
[m][cb]overlay=x=0:y='40*pow(1-min(1,max(0,(t-$BIN)/0.5)),2)':format=auto,format=yuv420p,trim=duration=$DUR[v]" \
    -map "[v]" -r $FPS -c:v libx264 -preset medium -crf 18 "$OUT"
  echo "built $OUT ($DUR s)"
}

# Scene 1: slow glide over the top sections + fade-in opener card
fadescene seq-landing3 16 w-open.png 0.7 5.0 w1.mp4
# Scene 2: hub type+scroll (30f @ 7fps = 4.3s bg), 9.0s total, captions switch at 4.6
cardscene seq-hub2 7 w-hubA.png w-hubB.png 9.0 4.6 w2.mp4
# Scene 3: hold on the Triangle, click The Church House, slow scroll
cardscene seq-book3 8 w-bookA.png w-bookB.png 9.8 5.4 w3.mp4
# Scene 4 (plays fifth, the case-study coda): bot typing + answer, 10.5s, switch 5.2
cardscene seq-bot 6 w-botA.png w-botB.png 10.5 5.2 w4.mp4
# Scene 5 (plays fourth): comparative clicks, 9.0s, switch 4.6
cardscene seq-comp 3.5 w-compA.png w-compB.png 9.0 4.6 w5.mp4
# Scene 6: outro typed URL over hero
typedscene seq-landing2 40 tseq-out 13 5.0 w6.mp4

D1=$(ffprobe -v error -show_entries format=duration -of csv=p=0 w1.mp4)
D2=$(ffprobe -v error -show_entries format=duration -of csv=p=0 w2.mp4)
D3=$(ffprobe -v error -show_entries format=duration -of csv=p=0 w3.mp4)
D4=$(ffprobe -v error -show_entries format=duration -of csv=p=0 w5.mp4)
D5=$(ffprobe -v error -show_entries format=duration -of csv=p=0 w4.mp4)
O1=$(python3 -c "print(round($D1-$TD,3))")
O2=$(python3 -c "print(round($O1+$D2-$TD,3))")
O3=$(python3 -c "print(round($O2+$D3-$TD,3))")
O4=$(python3 -c "print(round($O3+$D4-$TD,3))")
O5=$(python3 -c "print(round($O4+$D5-$TD,3))")
echo "offsets: $O1 $O2 $O3 $O4 $O5"

ffmpeg -y -loglevel error \
  -i w1.mp4 -i w2.mp4 -i w3.mp4 -i w5.mp4 -i w4.mp4 -i w6.mp4 \
  -filter_complex "\
[0:v][1:v]xfade=transition=slideleft:duration=$TD:offset=$O1[a];\
[a][2:v]xfade=transition=smoothup:duration=$TD:offset=$O2[b];\
[b][3:v]xfade=transition=circleopen:duration=$TD:offset=$O3[c];\
[c][4:v]xfade=transition=slideleft:duration=$TD:offset=$O4[d];\
[d][5:v]xfade=transition=fade:duration=$TD:offset=$O5,format=yuv420p[v]" \
  -map "[v]" -r $FPS -c:v libx264 -preset slow -crf 19 -movflags +faststart \
  DoingChurchTogether-promo-v3.mp4

echo "--- final ---"
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 DoingChurchTogether-promo-v3.mp4
