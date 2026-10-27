// Local preparation only. swift -module-cache-path /private/tmp/mr-pink-swift-cache
// scripts/extract-roses-mov-audio.swift reference/roses-original-recording/source.mov /private/tmp/roses-source.f32
import AVFoundation
let asset = AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1]))
let tracks = asset.tracks(withMediaType: .audio)
precondition(tracks.count == 1, "Inspect multiple audio tracks before selecting one.")
let track = tracks[0]
let format = track.formatDescriptions.first as! CMAudioFormatDescription
let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(format)!.pointee
precondition(asbd.mSampleRate == 48000 && asbd.mChannelsPerFrame == 2)
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false])
reader.add(output)
guard reader.startReading() else { throw reader.error! }
var pcm = Data()
while let sample = output.copyNextSampleBuffer() {
 if let block = CMSampleBufferGetDataBuffer(sample) {
  let n = CMBlockBufferGetDataLength(block)
  var bytes = [UInt8](repeating: 0, count: n)
  CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: n, destination: &bytes)
  pcm.append(contentsOf: bytes)
 }
}
guard reader.status == .completed else { throw reader.error! }
try pcm.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
print("Native float32 stereo PCM: \(pcm.count / 8) frames at 48000 Hz. No gain, pitch or tempo processing.")
