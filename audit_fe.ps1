$feDir = "d:\Project 2_20242\Tun\parking-lot\fe"

# Get all relevant source files (excluding node_modules, .next, .swc)
$sourceFiles = Get-ChildItem -Path $feDir -Recurse -Include "*.js","*.jsx","*.mjs" | Where-Object {
    $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*.next*" -and $_.FullName -notlike "*.swc*"
}

# Only app files (production code)
$appFiles = $sourceFiles | Where-Object { $_.FullName -notlike "*__tests__*" }

# Only test files
$testFiles = $sourceFiles | Where-Object { $_.FullName -like "*__tests__*" }

# Build concatenated content for app and test separately
$appContent = ""
foreach ($f in $appFiles) {
    $c = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
    if ($c) { $appContent += $c + "`n" }
}

$testContent = ""
foreach ($f in $testFiles) {
    $c = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
    if ($c) { $testContent += $c + "`n" }
}

# Suspects: component/utility names to check for imports (NOT self-references)
# We check if the name appears in import statements of OTHER files
$suspects = @(
    @{Name="PrintableTicket"; File="fe/app/components/common/PrintableTicket.jsx"},
    @{Name="MonthlySubForm"; File="fe/app/components/admin/MonthlySubForm.jsx"},
    @{Name="PayOSEmbed"; File="fe/app/components/payment/PayOSEmbed.jsx"},
    @{Name="ResultPanel"; File="fe/app/employee/checkin/components/ResultPanel.jsx"},
    @{Name="employee/Sidebar"; File="fe/app/components/employee/Sidebar.jsx"},
    @{Name="employee.audit.client"; File="fe/app/api/employee.audit.client.js"}
)

Write-Output "=== IMPORT REFERENCE CHECK ==="
foreach ($s in $suspects) {
    $pattern = $s.Name
    $appMatches = ([regex]::Matches($appContent, [regex]::Escape($pattern))).Count
    $testMatches = ([regex]::Matches($testContent, [regex]::Escape($pattern))).Count
    Write-Output "$($s.Name): app=$appMatches, test=$testMatches (file: $($s.File))"
}

Write-Output ""
Write-Output "=== DYNAMIC IMPORT CHECK ==="
foreach ($f in $appFiles) {
    $c = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
    if ($c -match "import\s*\(") {
        # Check if it's a non-literal dynamic import
        $lines = Get-Content -LiteralPath $f.FullName -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            if ($line -match "import\s*\(" -and $line -notmatch "import\s*\(\s*[`"']") {
                $rel = $f.FullName.Replace("d:\Project 2_20242\Tun\parking-lot\", "")
                Write-Output "SUSPICIOUS DYNAMIC: $rel -> $($line.Trim())"
            }
        }
    }
}

Write-Output ""
Write-Output "=== EMPTY ROUTE DIRS ==="
$routeDirs = @(
    "d:\Project 2_20242\Tun\parking-lot\fe\app\admin\export",
    "d:\Project 2_20242\Tun\parking-lot\fe\app\admin\monthly-subs",
    "d:\Project 2_20242\Tun\parking-lot\fe\app\admin\import",
    "d:\Project 2_20242\Tun\parking-lot\fe\app\employee\checkin\rfid\components",
    "d:\Project 2_20242\Tun\parking-lot\fe\app\employee\checkout\[sessionid]\customer"
)
foreach ($dir in $routeDirs) {
    if (Test-Path $dir) {
        $items = Get-ChildItem -Path $dir -ErrorAction SilentlyContinue
        if (-not $items -or $items.Count -eq 0) {
            Write-Output "EMPTY DIR: $($dir.Replace('d:\Project 2_20242\Tun\parking-lot\', ''))"
        }
    }
}

