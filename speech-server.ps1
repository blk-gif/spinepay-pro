Add-Type -AssemblyName System.Speech
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$recognizer.SetInputToDefaultAudioDevice()

[Console]::Error.WriteLine("SAPI: Recognizer ready, listening...")

$recognizer.add_SpeechRecognized({
    param($sender, $e)
    $text = $e.Result.Text
    $confidence = $e.Result.Confidence
    [Console]::Error.WriteLine("SAPI: Heard '$text' confidence=$confidence")
    [Console]::Out.WriteLine("RESULT:$text")
    [Console]::Out.Flush()
})

$recognizer.add_SpeechRecognitionRejected({
    param($sender, $e)
    [Console]::Error.WriteLine("SAPI: Speech rejected (low confidence)")
})

$recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

# Keep running until stdin closes or STOP received
while ($true) {
    $line = [Console]::In.ReadLine()
    if ($line -eq $null -or $line -eq "STOP") {
        $recognizer.RecognizeAsyncStop()
        break
    }
    Start-Sleep -Milliseconds 100
}
