Add-Type -AssemblyName System.Speech
$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$recognizer.SetInputToDefaultAudioDevice()

$recognizer.add_SpeechRecognized({
    param($sender, $e)
    $text = $e.Result.Text
    Write-Output "RESULT:$text"
    [Console]::Out.Flush()
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
