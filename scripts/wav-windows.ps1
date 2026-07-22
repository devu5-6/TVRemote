param([string]$Path = "D:\practice\TVRemote\voice_debug.wav")
$bytes = [System.IO.File]::ReadAllBytes($Path)
# 8000 samples/sec, 2 bytes/sample -> 16000 bytes per second window
$window = 16000
$start = 44
$second = 0
for ($off = $start; $off -lt $bytes.Length - 1; $off += $window) {
    $end = [Math]::Min($off + $window, $bytes.Length - 1)
    $sum = 0.0
    $peak = 0
    $count = 0
    for ($i = $off; $i -lt $end - 1; $i += 2) {
        $sample = [BitConverter]::ToInt16($bytes, $i)
        $abs = [Math]::Abs([int]$sample)
        if ($abs -gt $peak) { $peak = $abs }
        $sum += [double]$sample * $sample
        $count++
    }
    if ($count -gt 0) {
        $rms = [Math]::Round([Math]::Sqrt($sum / $count), 0)
        Write-Output ("sec " + $second + ": rms=" + $rms + " peak=" + $peak)
    }
    $second++
}
