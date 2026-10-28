$ErrorActionPreference = "Stop"
$routes = @{
  "/" = @{ File = "index.html"; Type = "text/html; charset=utf-8" }
  "/index.html" = @{ File = "index.html"; Type = "text/html; charset=utf-8" }
  "/products.html" = @{ File = "products.html"; Type = "text/html; charset=utf-8" }
  "/client.js" = @{ File = "client.js"; Type = "text/javascript; charset=utf-8" }
  "/products.js" = @{ File = "products.js"; Type = "text/javascript; charset=utf-8" }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 3000)
$listener.Start()
Write-Host "App running at http://localhost:3000. Keep this window open; press Ctrl+C to stop."
Start-Process "http://localhost:3000"

try {
  while ($listener.Server.IsBound) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream)
      $requestLine = $reader.ReadLine()
      while ($null -ne ($header = $reader.ReadLine()) -and $header.Length -gt 0) {}

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $parts = $requestLine -split " "
      $method = $parts[0]
      $requestPath = ($parts[1] -split "\?", 2)[0]

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $status = "405 Method Not Allowed"
        $contentType = "text/plain; charset=utf-8"
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method not allowed")
      } elseif (-not $routes.ContainsKey($requestPath)) {
        $status = "404 Not Found"
        $contentType = "text/plain; charset=utf-8"
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      } else {
        $route = $routes[$requestPath]
        $status = "200 OK"
        $contentType = $route.Type
        $body = [System.IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $route.File))
      }

      $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n"
      if ($status -eq "405 Method Not Allowed") {
        $headers += "Allow: GET, HEAD`r`n"
      }
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes("$headers`r`n")
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      if ($method -eq "GET") {
        $stream.Write($body, 0, $body.Length)
      }
      $stream.Flush()
      $reader.Dispose()
    } catch {
      [Console]::Error.WriteLine("Could not serve request: $_")
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
