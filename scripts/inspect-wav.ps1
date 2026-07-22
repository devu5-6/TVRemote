param([string]$Path = "D:\practice\TVRemote\voice_debug.wav")
$bytes = [System.IO.File]::ReadAllBytes($Path)
Write-Output ("size=" + $bytes.Length)
Write-Output ("riff=" + [System.Text.Encoding]::ASCII.GetString($bytes[0..3]))
Write-Output ("sampleRate=" + [BitConverter]::ToInt32($bytes, 24))
Write-Output ("channels=" + [BitConverter]::ToInt16($bytes, 22))
Write-Output ("bitsPerSample=" + [BitConverter]::ToInt16($bytes, 34))

# Compute RMS amplitude of the 16-bit PCM data (after the 44-byte header) to
# check the mic actually captured real speech rather than silence.
$sum = 0.0
$count = 0
for ($i = 44; $i -lt $bytes.Length - 1; $i += 2) {
    $sample = [BitConverter]::ToInt16($bytes, $i)
    $sum += [double]$sample * $sample
    $count++
}
if ($count -gt 0) {
    $rms = [Math]::Sqrt($sum / $count)
    Write-Output ("samples=" + $count)
    Write-Output ("rms=" + [Math]::Round($rms, 1))
}
