Add-Type -AssemblyName System.Speech
[Console]::Error.WriteLine("PS: Starting...")

$rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$rec.SetInputToDefaultAudioDevice()

[Console]::Error.WriteLine("PS: Grammar loaded, device set")

$rec.add_SpeechRecognized({
    param($s, $e)
    $t = $e.Result.Text
    [Console]::Error.WriteLine("PS: Recognized: $t")
    [Console]::Out.WriteLine("RESULT:$t")
    [Console]::Out.Flush()
})

[Console]::Error.WriteLine("PS: Starting async recognition...")
$rec.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
[Console]::Error.WriteLine("PS: Listening. Send STOP to quit.")

while ($true) {
    if ([Console]::In.Peek() -ne -1) {
        $line = [Console]::In.ReadLine()
        if ($line -eq "STOP") { break }
    }
    Start-Sleep -Milliseconds 200
}

$rec.RecognizeAsyncStop()
[Console]::Error.WriteLine("PS: Stopped.")
