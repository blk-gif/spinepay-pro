$global:log = "$env:TEMP\spinepay-speech.log"
[System.IO.File]::WriteAllText($global:log, "$(Get-Date) - Script started`n")

function Log($msg) {
    [System.IO.File]::AppendAllText($global:log, "$(Get-Date) - $msg`n")
}

try {
    Add-Type -AssemblyName System.Speech
    Log "Assembly loaded"

    $global:rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
    Log "Engine created"

    $global:rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    Log "Grammar loaded"

    $global:rec.SetInputToDefaultAudioDevice()
    Log "Audio device set"

    # Use Register-ObjectEvent so handlers run on the main thread (thread-safe)
    Register-ObjectEvent -InputObject $global:rec -EventName SpeechDetected -SourceIdentifier 'SD' -Action {
        [System.IO.File]::AppendAllText($global:log, "$(Get-Date) - *** SPEECH DETECTED ***`n")
    } | Out-Null

    Register-ObjectEvent -InputObject $global:rec -EventName SpeechRecognized -SourceIdentifier 'SR' -Action {
        $t = $Event.SourceEventArgs.Result.Text
        [System.IO.File]::AppendAllText($global:log, "$(Get-Date) - Recognized: $t`n")
        [Console]::Out.WriteLine("RESULT:$t")
        [Console]::Out.Flush()
    } | Out-Null

    Register-ObjectEvent -InputObject $global:rec -EventName SpeechRecognitionRejected -SourceIdentifier 'SRR' -Action {
        [System.IO.File]::AppendAllText($global:log, "$(Get-Date) - Rejected (low confidence)`n")
    } | Out-Null

    $global:rec.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
    Log "RecognizeAsync started, listening..."

    $tick = 0
    while ($true) {
        # Wait-Event pumps the event queue so Register-ObjectEvent handlers fire
        Wait-Event -Timeout 1 -ErrorAction SilentlyContinue | Remove-Event -ErrorAction SilentlyContinue
        $tick++
        if ($tick % 5 -eq 0) {
            Log "Heartbeat tick=$tick"
        }
    }

} catch {
    [System.IO.File]::AppendAllText($global:log, "$(Get-Date) - CAUGHT: $_ ($($_.Exception.GetType().FullName))`n")
    Write-Host "ERROR:$_"
}
