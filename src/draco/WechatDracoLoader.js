
import createDracoDecoder from './draco_decoder.js';

import {
  BufferGeometry,
  BufferAttribute
} from 'three-platformize';

export class WechatDracoLoader {
  constructor() {
    this.decoderPromise = null;
  }

  preload() {
    if (!this.decoderPromise) {
      this.decoderPromise = Promise.resolve()
        .then(() => createDracoDecoder({}))
        .then((module) => {
          console.log('[Draco] Decoder initialized');
          return module;
        });
    }

    return this;
  }

  decodeDracoFile(
    buffer,
    callback,
    attributeIDs = {},
    attributeTypes = {}
  ) {
    return this.decodeGeometry(
      buffer,
      attributeIDs,
      attributeTypes
    ).then((geometry) => {
      if (typeof callback === 'function') {
        callback(geometry);
      }

      return geometry;
    });
  }

  async decodeGeometry(buffer, attributeIDs, attributeTypes) {
    this.preload();

    const module = await this.decoderPromise;

    const bytes = new Int8Array(buffer);

    const decoder = new module.Decoder();
    const decoderBuffer = new module.DecoderBuffer();

    let dracoGeometry = null;

    try {
      decoderBuffer.Init(bytes, bytes.byteLength);

      const geometryType =
        decoder.GetEncodedGeometryType(decoderBuffer);

      const isMesh =
        geometryType === module.TRIANGULAR_MESH;

      const isPointCloud =
        geometryType === module.POINT_CLOUD;

      if (!isMesh && !isPointCloud) {
        throw new Error(
          `Unsupported Draco geometry type: ${geometryType}`
        );
      }

      dracoGeometry = isMesh
        ? new module.Mesh()
        : new module.PointCloud();

      const status = isMesh
        ? decoder.DecodeBufferToMesh(
            decoderBuffer,
            dracoGeometry
          )
        : decoder.DecodeBufferToPointCloud(
            decoderBuffer,
            dracoGeometry
          );

      if (!status.ok() || dracoGeometry.ptr === 0) {
        throw new Error(
          `Draco decode failed: ${status.error_msg()}`
        );
      }

      const geometry = new BufferGeometry();
      const vertexCount = dracoGeometry.num_points();

      for (const attributeName of Object.keys(attributeIDs)) {
        const uniqueID = attributeIDs[attributeName];

        const dracoAttribute =
          decoder.GetAttributeByUniqueId(
            dracoGeometry,
            uniqueID
          );

        if (!dracoAttribute || dracoAttribute.ptr === 0) {
          throw new Error(
            `Draco attribute missing: ${attributeName}, id=${uniqueID}`
          );
        }

        const componentCount =
          dracoAttribute.num_components();

        const valueCount =
          vertexCount * componentCount;

        // 使用 Float32 读取所有属性，优先验证模型的
        // POSITION / NORMAL / TEXCOORD 等常见属性。
        const dracoArray = new module.DracoFloat32Array();

        try {
          const success =
            decoder.GetAttributeFloatForAllPoints(
              dracoGeometry,
              dracoAttribute,
              dracoArray
            );

          if (!success) {
            throw new Error(
              `Failed to read Draco attribute: ${attributeName}`
            );
          }

          const values = new Float32Array(valueCount);

          for (let i = 0; i < valueCount; i++) {
            values[i] = dracoArray.GetValue(i);
          }

          geometry.setAttribute(
            attributeName,
            new BufferAttribute(
              values,
              componentCount
            )
          );

          console.log(
            `[Draco] Attribute ${attributeName}:`,
            vertexCount,
            'vertices,',
            componentCount,
            'components'
          );
        } finally {
          module.destroy(dracoArray);
        }
      }

      if (isMesh) {
        const faceCount = dracoGeometry.num_faces();
        const indexCount = faceCount * 3;

        const indices = vertexCount > 65535
          ? new Uint32Array(indexCount)
          : new Uint16Array(indexCount);

        const face = new module.DracoInt32Array();

        try {
          for (let i = 0; i < faceCount; i++) {
            decoder.GetFaceFromMesh(
              dracoGeometry,
              i,
              face
            );

            const offset = i * 3;

            indices[offset] = face.GetValue(0);
            indices[offset + 1] = face.GetValue(1);
            indices[offset + 2] = face.GetValue(2);
          }
        } finally {
          module.destroy(face);
        }

        geometry.setIndex(
          new BufferAttribute(indices, 1)
        );

        console.log(
          '[Draco] Mesh decoded:',
          vertexCount,
          'vertices,',
          faceCount,
          'faces'
        );
      }

      if (geometry.getAttribute('position')) {
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
      }

      return geometry;
    } finally {
      if (dracoGeometry) {
        module.destroy(dracoGeometry);
      }

      module.destroy(decoderBuffer);
      module.destroy(decoder);
    }
  }

  dispose() {
    this.decoderPromise = null;
  }
}
