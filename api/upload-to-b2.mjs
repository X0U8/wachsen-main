export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const isGet = req.method === 'GET';
    let action, fileName, fileType, fileBase64;

    if (isGet) {
      action = 'get-file';
      fileName = req.query.path;
    } else {
      ({ action, fileName, fileType, fileBase64 } = req.body);
    }

    const b2KeyId = process.env.B2_KEY_ID;
    const b2AppKey = process.env.B2_APPLICATION_KEY;
    const b2BucketId = process.env.B2_BUCKET_ID;
    const b2BucketName = process.env.B2_BUCKET_NAME;

    if (!b2KeyId || !b2AppKey || !b2BucketId || !b2BucketName) {
      return res.status(500).json({ error: 'Backblaze B2 configuration is missing in environment variables.' });
    }


    const authCredentials = Buffer.from(`${b2KeyId}:${b2AppKey}`).toString('base64');
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { 'Authorization': `Basic ${authCredentials}` }
    });

    if (!authResponse.ok) {
      const authErr = await authResponse.text();
      throw new Error(`B2 Authorization failed: ${authErr}`);
    }

    const authData = await authResponse.json();
    const { apiInfo, authorizationToken: accountToken } = authData;
    const { apiUrl, downloadUrl } = apiInfo.storageApi;


    if (action === 'get-file') {
      if (!fileName) {
        return res.status(400).json({ error: 'Missing path parameter.' });
      }


      const downloadAuthResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_download_authorization`, {
        method: 'POST',
        headers: {
          'Authorization': accountToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bucketId: b2BucketId,
          fileNamePrefix: fileName,
          validDurationInSeconds: 3600
        })
      });

      if (!downloadAuthResponse.ok) {
        const downloadAuthErr = await downloadAuthResponse.text();
        throw new Error(`B2 Get Download Authorization failed: ${downloadAuthErr}`);
      }

      const downloadAuthData = await downloadAuthResponse.json();
      const downloadToken = downloadAuthData.authorizationToken;


      const b2FileResponse = await fetch(`${downloadUrl}/file/${b2BucketName}/${fileName}?Authorization=${downloadToken}`);
      if (!b2FileResponse.ok) {
        throw new Error(`Failed to fetch file from B2 storage: ${b2FileResponse.statusText}`);
      }

      const arrayBuffer = await b2FileResponse.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);


      res.setHeader('Content-Type', b2FileResponse.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
      return res.send(fileBuffer);
    }


    if (action === 'upload') {
      if (!fileName || !fileBase64) {
        return res.status(400).json({ error: 'Missing fileName or fileBase64 data.' });
      }


      const uploadUrlResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: 'POST',
        headers: {
          'Authorization': accountToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucketId: b2BucketId })
      });

      if (!uploadUrlResponse.ok) {
        const uploadUrlErr = await uploadUrlResponse.text();
        throw new Error(`B2 Get Upload URL failed: ${uploadUrlErr}`);
      }

      const uploadUrlData = await uploadUrlResponse.json();
      const { uploadUrl, authorizationToken: uploadToken } = uploadUrlData;


      const fileBuffer = Buffer.from(fileBase64.split(',')[1] || fileBase64, 'base64');
      const encodedFileName = encodeURIComponent(fileName);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': uploadToken,
          'X-Bz-File-Name': encodedFileName,
          'Content-Type': fileType || 'image/jpeg',
          'X-Bz-Content-Sha1': 'do_not_verify'
        },
        body: fileBuffer
      });

      if (!uploadResponse.ok) {
        const uploadErr = await uploadResponse.text();
        throw new Error(`B2 Upload failed: ${uploadErr}`);
      }

      const uploadResult = await uploadResponse.json();


      const proxyUrl = `/api/upload-to-b2?path=${fileName}`;

      return res.status(200).json({
        success: true,
        url: proxyUrl,
        fileId: uploadResult.fileId,
        fileName: uploadResult.fileName
      });
    }


    if (action === 'get-url') {
      if (!fileName) {
        return res.status(400).json({ error: 'Missing fileName.' });
      }

      const downloadAuthResponse = await fetch(`${apiUrl}/b2api/v3/b2_get_download_authorization`, {
        method: 'POST',
        headers: {
          'Authorization': accountToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bucketId: b2BucketId,
          fileNamePrefix: fileName,
          validDurationInSeconds: 86400
        })
      });

      if (!downloadAuthResponse.ok) {
        const downloadAuthErr = await downloadAuthResponse.text();
        throw new Error(`B2 Get Download Authorization failed: ${downloadAuthErr}`);
      }

      const downloadAuthData = await downloadAuthResponse.json();
      const downloadToken = downloadAuthData.authorizationToken;

      const secureUrl = `${downloadUrl}/file/${b2BucketName}/${fileName}?Authorization=${downloadToken}`;

      return res.status(200).json({
        success: true,
        url: secureUrl
      });
    }


    if (action === 'list') {
      if (!fileName) {
        return res.status(400).json({ error: 'Missing prefix (fileName).' });
      }

      const listResponse = await fetch(`${apiUrl}/b2api/v3/b2_list_file_names`, {
        method: 'POST',
        headers: {
          'Authorization': accountToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bucketId: b2BucketId,
          prefix: fileName
        })
      });

      if (!listResponse.ok) {
        const listErr = await listResponse.text();
        throw new Error(`B2 List File Names failed: ${listErr}`);
      }

      const listData = await listResponse.json();
      const files = (listData.files || []).map(file => ({
        fileName: file.fileName,
        fileId: file.fileId,
        size: file.contentLength,
        url: `/api/upload-to-b2?path=${file.fileName}`
      }));

      return res.status(200).json({
        success: true,
        files
      });
    }

    return res.status(400).json({ error: 'Invalid or unsupported action.' });

  } catch (err) {
    console.error('Backblaze B2 operation error:', err);
    return res.status(500).json({ error: err.message });
  }
}
